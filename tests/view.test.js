const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
const { mockReqRes } = require("@saltcorn/data/tests/mocks");
const { afterAll, beforeAll, describe, it, expect } = require("@jest/globals");

getState().registerPlugin("base", require("@saltcorn/data/base-plugin"));
getState().registerPlugin("@saltcorn/statistics", require(".."));

afterAll(require("@saltcorn/data/db").close);
beforeAll(async () => {
  // works when plugin-test prepares the db with the backup-file option
  await getState().refresh(true);

  // otherwise, do this:
  // const { prep_test_db } = require("@saltcorn/cli/src/common");
  // const path = require("path");
  // await prep_test_db(
  //   path.join(__dirname, "backup.zip"),
  //   // is okay because this plugin is loaded into the cli package
  //   require("@saltcorn/server/load_plugins")
  // );
});

describe("statistics plugin tests", () => {
  it("run count_books", async () => {
    const view = await View.findOne({ name: "test_count_books" });
    const result = await view.run({}, mockReqRes);
    const books = Table.findOne({ name: "books" });
    const dbCount = await books.countRows();
    expect(result).toBe(
      `<div><span class="test_count_books">${dbCount}</span></div>`
    );
  });
});
