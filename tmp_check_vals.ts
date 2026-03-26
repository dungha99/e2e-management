
import { vucarV2Query } from "./lib/db"

async function check() {
  const result = await vucarV2Query("SELECT DISTINCT qualified FROM sale_status WHERE qualified IS NOT NULL", [])
  console.log(result.rows)
}

check()
