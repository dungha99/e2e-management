import { Pool } from "pg";

// Use global object to cache the pool across hot reloads in development
const globalForDb = globalThis as unknown as {
  drmPool: Pool | undefined;
  vucarV2Pool: Pool | undefined;
  tempInspectionPool: Pool | undefined;
  e2ePool: Pool | undefined;
  followupDataPool: Pool | undefined;
};

export function getDrmPool(): Pool {
  if (!globalForDb.drmPool) {
    globalForDb.drmPool = new Pool({
      host: process.env.DRM_DB_HOST,
      port: parseInt(process.env.DRM_DB_PORT || "5432"),
      database: process.env.DRM_DB_NAME,
      user: process.env.DRM_DB_USER,
      password: process.env.DRM_DB_PASSWORD,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 15,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 20000,
    });

    globalForDb.drmPool.on("error", (err) => {
      console.error("Unexpected error on idle DRM client", err);
    });
  }

  return globalForDb.drmPool;
}

export function getVucarV2Pool(): Pool {
  if (!globalForDb.vucarV2Pool) {
    globalForDb.vucarV2Pool = new Pool({
      host: process.env.VUCAR_V2_DB_HOST,
      port: parseInt(process.env.VUCAR_V2_DB_PORT || "5432"),
      database: process.env.VUCAR_V2_DB_NAME,
      user: process.env.VUCAR_V2_DB_USER,
      password: process.env.VUCAR_V2_DB_PASSWORD,
      // Enable SSL for AWS RDS but don't reject unauthorized certificates
      ssl: { rejectUnauthorized: false },
      max: 15,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 20000,
    });

    globalForDb.vucarV2Pool.on("error", (err) => {
      console.error("Unexpected error on idle VuCar V2 client", err);
    });
  }

  return globalForDb.vucarV2Pool;
}

// Legacy function for backward compatibility
export function getPool(): Pool {
  return getDrmPool();
}

export async function query(text: string, params?: any[]) {
  const pool = getDrmPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (>500ms)
    if (duration > 500) {
      console.warn("Slow DRM query detected:", {
        duration: `${duration}ms`,
        query: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        rowCount: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    console.error("query error", { text, error });
    throw error;
  }
}

export async function vucarV2Query(text: string, params?: any[]) {
  const pool = getVucarV2Pool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (>500ms)
    if (duration > 500) {
      console.warn("Slow VuCar V2 query detected:", {
        duration: `${duration}ms`,
        query: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        rowCount: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    console.error("vucar-v2 query error", { text, error });
    throw error;
  }
}

export function getTempInspectionPool(): Pool {
  if (!globalForDb.tempInspectionPool) {
    globalForDb.tempInspectionPool = new Pool({
      host: process.env.TEMP_INSPECTION_DB_HOST,
      port: parseInt(process.env.TEMP_INSPECTION_DB_PORT || "5432"),
      database: process.env.TEMP_INSPECTION_DB_NAME,
      user: process.env.TEMP_INSPECTION_DB_USER,
      password: process.env.TEMP_INSPECTION_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 15,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 20000,
    });

    globalForDb.tempInspectionPool.on("error", (err) => {
      console.error("Unexpected error on idle Temp Inspection client", err);
    });
  }

  return globalForDb.tempInspectionPool;
}

export async function tempInspectionQuery(text: string, params?: any[]) {
  const pool = getTempInspectionPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (>500ms)
    if (duration > 500) {
      console.warn("Slow Temp Inspection query detected:", {
        duration: `${duration}ms`,
        query: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        rowCount: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    console.error("temp-inspection query error", { text, error });
    throw error;
  }
}

export function getE2ePool(): Pool {
  if (!globalForDb.e2ePool) {
    globalForDb.e2ePool = new Pool({
      host: process.env.E2E_DB_HOST,
      port: parseInt(process.env.E2E_DB_PORT || "5432"),
      database: process.env.E2E_DB_NAME,
      user: process.env.E2E_DB_USER,
      password: process.env.E2E_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 15,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 20000,
    });

    globalForDb.e2ePool.on("error", (err) => {
      console.error("Unexpected error on idle E2E client", err);
    });
  }

  return globalForDb.e2ePool;
}
export function getFollowupDataPool(): Pool {
  if (!globalForDb.followupDataPool) {
    globalForDb.followupDataPool = new Pool({
      host: process.env.E2E_DB_HOST,
      port: parseInt(process.env.E2E_DB_PORT || "5432"),
      database: "followup_data",
      user: process.env.E2E_DB_USER,
      password: process.env.E2E_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      max: 15,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 20000,
    });

    globalForDb.followupDataPool.on("error", (err) => {
      console.error("Unexpected error on idle Followup Data client", err);
    });
  }

  return globalForDb.followupDataPool;
}

export async function followupDataQuery(text: string, params?: any[]) {
  const pool = getFollowupDataPool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (>500ms)
    if (duration > 500) {
      console.warn("Slow Followup Data query detected:", {
        duration: `${duration}ms`,
        query: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        rowCount: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    console.error("followup-data query error", { text, error });
    throw error;
  }
}

export async function e2eQuery(text: string, params?: any[]) {
  const pool = getE2ePool();
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (>500ms)
    if (duration > 500) {
      console.warn("Slow E2E query detected:", {
        duration: `${duration}ms`,
        query: text.substring(0, 100) + (text.length > 100 ? "..." : ""),
        rowCount: res.rowCount,
      });
    }

    return res;
  } catch (error) {
    console.error("e2e query error", { text, error });
    throw error;
  }
}
