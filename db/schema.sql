-- =============================================================================
-- Nivasa — PostGIS schema
--
-- The production path. In development Nivasa runs on an in-memory spatial store
-- (src/lib/data/store.ts) that implements the same repository interface, so the
-- app works with no database at all. Swapping to Postgres means reimplementing
-- src/lib/data/store.ts against these tables — nothing above the repository
-- layer changes.
--
--   createdb nivasa && psql nivasa -f db/schema.sql
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------- geography --

CREATE TABLE cities (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  country     text NOT NULL DEFAULT 'IN',
  center      geography(Point, 4326) NOT NULL,
  bbox        geography(Polygon, 4326) NOT NULL,
  timezone    text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE localities (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id           uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  corridor          text,
  character         text,
  summary           text,
  boundary          geography(MultiPolygon, 4326) NOT NULL,
  center            geography(Point, 4326) NOT NULL,
  avg_price_sqft    numeric(10,2),
  median_price      bigint,
  rental_yield_pct  numeric(4,2),
  momentum_pct      numeric(5,2),
  inventory_count   integer NOT NULL DEFAULT 0,
  project_count     integer NOT NULL DEFAULT 0,
  hero_image_url    text,
  -- Locality economics are modelled, never presented as recorded transactions.
  data_quality      text NOT NULL DEFAULT 'estimated'
                    CHECK (data_quality IN ('verified','listed','estimated')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX localities_boundary_gix ON localities USING GIST (boundary);
CREATE INDEX localities_center_gix   ON localities USING GIST (center);
CREATE INDEX localities_city_idx     ON localities (city_id);
CREATE INDEX localities_name_trgm    ON localities USING GIN (name gin_trgm_ops);

CREATE TABLE developers (
  id                 uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name               text NOT NULL,
  slug               text NOT NULL UNIQUE,
  logo_url           text,
  established_year   integer,
  projects_delivered integer NOT NULL DEFAULT 0,
  rera_registered    boolean NOT NULL DEFAULT false,
  about              text,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX developers_name_trgm ON developers USING GIN (name gin_trgm_ops);

CREATE TABLE projects (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  developer_id     uuid NOT NULL REFERENCES developers(id) ON DELETE RESTRICT,
  locality_id      uuid NOT NULL REFERENCES localities(id) ON DELETE RESTRICT,
  name             text NOT NULL,
  slug             text NOT NULL UNIQUE,
  location         geography(Point, 4326) NOT NULL,
  footprint        geography(Polygon, 4326),
  status           text NOT NULL CHECK (status IN ('new_launch','under_construction','ready','upcoming')),
  possession_date  date,
  rera_number      text,
  rera_verified    boolean NOT NULL DEFAULT false,
  price_min        bigint,
  price_max        bigint,
  units_total      integer,
  units_available  integer,
  land_area_acres  numeric(6,2),
  towers           integer,
  floors           integer,
  configurations   text[] NOT NULL DEFAULT '{}',
  description      text,
  hero_image_url   text,
  brochure_url     text,
  data_quality     text NOT NULL DEFAULT 'listed'
                   CHECK (data_quality IN ('verified','listed','estimated')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX projects_location_gix ON projects USING GIST (location);
CREATE INDEX projects_locality_idx ON projects (locality_id);
CREATE INDEX projects_status_idx   ON projects (status);
CREATE INDEX projects_name_trgm    ON projects USING GIN (name gin_trgm_ops);

-- ----------------------------------------------------------------- listings --

CREATE TABLE properties (
  id                   uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id           uuid REFERENCES projects(id) ON DELETE SET NULL,
  locality_id          uuid NOT NULL REFERENCES localities(id) ON DELETE RESTRICT,
  owner_user_id        uuid,
  listing_type         text NOT NULL CHECK (listing_type IN ('buy','rent')),
  property_type        text NOT NULL CHECK (property_type IN
                         ('apartment','villa','plot','independent_house','penthouse','farmhouse','commercial')),
  location             geography(Point, 4326) NOT NULL,
  address              text,
  title                text NOT NULL,
  slug                 text NOT NULL UNIQUE,
  description          text,

  price                bigint NOT NULL,
  price_per_sqft       numeric(10,2),
  rent_monthly         bigint,
  deposit              bigint,
  maintenance_monthly  integer,

  carpet_area_sqft     integer,
  builtup_area_sqft    integer NOT NULL,
  bedrooms             smallint NOT NULL DEFAULT 0,
  bathrooms            smallint NOT NULL DEFAULT 0,
  balconies            smallint NOT NULL DEFAULT 0,
  parking              smallint NOT NULL DEFAULT 0,
  floor                smallint,
  total_floors         smallint,
  facing               text,
  furnishing           text CHECK (furnishing IN ('unfurnished','semi_furnished','fully_furnished')),
  age_years            smallint,
  possession           text NOT NULL CHECK (possession IN
                         ('ready','within_6_months','within_1_year','under_construction')),
  availability_date    date,

  is_verified          boolean NOT NULL DEFAULT false,
  rera_number          text,
  -- Every surfaced figure is tagged so the UI can render trust honestly.
  data_quality         text NOT NULL DEFAULT 'listed'
                       CHECK (data_quality IN ('verified','listed','estimated')),
  status               text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('draft','pending_review','active','sold','withdrawn')),
  view_count           integer NOT NULL DEFAULT 0,
  search_tsv           tsvector,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rent_needs_monthly CHECK (listing_type <> 'rent' OR rent_monthly IS NOT NULL)
);

-- The spatial index every map query depends on.
CREATE INDEX properties_location_gix ON properties USING GIST (location);
-- Partial index: map queries only ever look at live inventory.
CREATE INDEX properties_active_location_gix
  ON properties USING GIST (location) WHERE status = 'active';
CREATE INDEX properties_locality_idx   ON properties (locality_id);
CREATE INDEX properties_project_idx    ON properties (project_id);
CREATE INDEX properties_listing_idx    ON properties (listing_type, status);
CREATE INDEX properties_price_idx      ON properties (listing_type, price);
CREATE INDEX properties_bedrooms_idx   ON properties (bedrooms);
CREATE INDEX properties_search_tsv     ON properties USING GIN (search_tsv);

CREATE FUNCTION properties_tsv_update() RETURNS trigger AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.address, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER properties_tsv_trigger
  BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW EXECUTE FUNCTION properties_tsv_update();

CREATE TABLE property_images (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id  uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url          text NOT NULL,
  blurhash     text,
  width        integer,
  height       integer,
  room_tag     text,
  sort_order   smallint NOT NULL DEFAULT 0
);
CREATE INDEX property_images_property_idx ON property_images (property_id, sort_order);

CREATE TABLE amenities (
  id       uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug     text NOT NULL UNIQUE,
  name     text NOT NULL,
  category text,
  icon     text
);

CREATE TABLE property_amenities (
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  amenity_id  uuid NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (property_id, amenity_id)
);

CREATE TABLE project_amenities (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, amenity_id)
);

-- --------------------------------------------------------------------- POIs --

CREATE TABLE pois (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id     uuid NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  name        text NOT NULL,
  category    text NOT NULL CHECK (category IN
                ('metro','school','hospital','office_hub','mall','park','stadium',
                 'airport','railway','restaurant','gym','temple')),
  subcategory text,
  location    geography(Point, 4326) NOT NULL,
  rating      numeric(2,1),
  verified    boolean NOT NULL DEFAULT false,
  source      text
);
CREATE INDEX pois_location_gix  ON pois USING GIST (location);
CREATE INDEX pois_category_idx  ON pois (city_id, category);
CREATE INDEX pois_name_trgm     ON pois USING GIN (name gin_trgm_ops);

CREATE TABLE price_history (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locality_id    uuid REFERENCES localities(id) ON DELETE CASCADE,
  property_id    uuid REFERENCES properties(id) ON DELETE CASCADE,
  period         date NOT NULL,
  price_per_sqft numeric(10,2),
  source         text,
  CONSTRAINT one_subject CHECK (num_nonnulls(locality_id, property_id) = 1)
);
CREATE INDEX price_history_locality_idx ON price_history (locality_id, period);

-- -------------------------------------------------------------------- users --

CREATE TABLE users (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email      citext UNIQUE,
  name       text,
  phone      text,
  avatar_url text,
  role       text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer','owner','broker','admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- The signature feature, persisted: the places a user's life happens.
CREATE TABLE user_anchors (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label       text NOT NULL,
  kind        text NOT NULL CHECK (kind IN ('office','school','family','gym','other')),
  location    geography(Point, 4326) NOT NULL,
  address     text,
  max_minutes integer,
  max_km      numeric(5,2),
  weight      numeric(3,2) NOT NULL DEFAULT 1.0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_anchors_user_idx     ON user_anchors (user_id);
CREATE INDEX user_anchors_location_gix ON user_anchors USING GIST (location);

CREATE TABLE saved_properties (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE saved_searches (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  filters       jsonb NOT NULL,
  anchors       jsonb NOT NULL DEFAULT '[]',
  alert_enabled boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_searches_user_idx ON saved_searches (user_id);

CREATE TABLE recently_viewed (
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  viewed_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE comparisons (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_ids uuid[] NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE enquiries (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid REFERENCES users(id) ON DELETE SET NULL,
  property_id  uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  kind         text NOT NULL CHECK (kind IN ('callback','visit','message')),
  message      text,
  contact_name text,
  contact_phone text,
  scheduled_at timestamptz,
  status       text NOT NULL DEFAULT 'new'
               CHECK (status IN ('new','contacted','scheduled','closed')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX enquiries_property_idx ON enquiries (property_id, status);

CREATE TABLE ai_conversations (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  title      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_messages (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user','assistant')),
  content         jsonb NOT NULL,
  tool_calls      jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_messages_conversation_idx ON ai_messages (conversation_id, created_at);

CREATE TABLE analytics_events (
  id         bigserial PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  session_id text,
  name       text NOT NULL,
  props      jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_name_idx ON analytics_events (name, created_at DESC);

-- =============================================================================
-- The queries the map actually runs. These mirror src/lib/data/repository.ts.
-- =============================================================================

-- Viewport search: everything inside the current map bounds.
--   SELECT p.* FROM properties p
--   WHERE p.status = 'active'
--     AND p.listing_type = $1
--     AND ST_Intersects(p.location, ST_MakeEnvelope($2,$3,$4,$5,4326)::geography)
--   LIMIT 300;

-- Radius search: "within 3 km of my office".
--   SELECT p.*, ST_Distance(p.location, $center) / 1000 AS km
--   FROM properties p
--   WHERE p.status = 'active'
--     AND ST_DWithin(p.location, $center::geography, $radius_m)
--   ORDER BY km;

-- Draw-area search: only what is inside the user's polygon.
--   SELECT p.* FROM properties p
--   WHERE p.status = 'active'
--     AND ST_Within(p.location::geometry, ST_GeomFromGeoJSON($1));

-- Livable Zone: the intersection of every anchor's reachable area, and the
-- homes inside it. This is the query the whole product is built around.
--   WITH discs AS (
--     SELECT ST_Buffer(a.location, (a.max_km * 1000)::double precision)::geometry AS g
--     FROM user_anchors a WHERE a.user_id = $1
--   ),
--   zone AS (
--     SELECT ST_Intersection(g) AS g FROM discs   -- aggregate intersection
--   )
--   SELECT p.* FROM properties p, zone
--   WHERE p.status = 'active' AND ST_Within(p.location::geometry, zone.g);

-- Server-side clustering above the browser's feature budget.
--   SELECT ST_ClusterDBSCAN(location::geometry, eps := $1, minpoints := 3)
--            OVER () AS cluster_id,
--          id, location, price
--   FROM properties WHERE status = 'active';

-- What's nearby, one row per category.
--   SELECT DISTINCT ON (category) name, category,
--          ST_Distance(location, $1::geography) / 1000 AS km
--   FROM pois
--   WHERE ST_DWithin(location, $1::geography, $2)
--   ORDER BY category, km;
