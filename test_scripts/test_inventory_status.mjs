/**
 * Test: check_inventory_status tool
 *
 * Calls the MCP check_inventory_status tool and verifies the response shape.
 * This is a dry-read test — no device connection required.
 */

import { InventoryStatusService } from "../dist/services/inventoryStatusService.js";

async function main() {
  const svc = new InventoryStatusService();
  const status = await svc.getStatus();

  console.log("check_inventory_status result:");
  console.log(JSON.stringify(status, null, 2));

  // Required fields
  const requiredFields = ["exists", "pluginCount", "generatedAt", "ageHours", "isStale", "message"];
  const missing = requiredFields.filter((f) => !(f in status));
  if (missing.length > 0) {
    console.error("FAIL: missing fields:", missing);
    process.exit(1);
  }

  if (typeof status.exists !== "boolean") {
    console.error("FAIL: exists must be boolean");
    process.exit(1);
  }
  if (typeof status.pluginCount !== "number") {
    console.error("FAIL: pluginCount must be number");
    process.exit(1);
  }
  if (typeof status.message !== "string" || status.message.length === 0) {
    console.error("FAIL: message must be a non-empty string");
    process.exit(1);
  }

  if (status.exists) {
    if (status.pluginCount < 1) {
      console.error("FAIL: inventory exists but pluginCount is 0");
      process.exit(1);
    }
    if (typeof status.ageHours !== "number") {
      console.error("FAIL: ageHours must be number when inventory exists");
      process.exit(1);
    }
    console.log(`\nPASS: inventory exists with ${status.pluginCount} plugins, age=${status.ageHours}h, stale=${status.isStale}`);
  } else {
    if (status.isStale !== true) {
      console.error("FAIL: missing inventory must be isStale=true");
      process.exit(1);
    }
    console.log("\nPASS: inventory missing — correct error message returned");
  }
}

main().catch((err) => {
  console.error("FAIL:", err);
  process.exit(1);
});
