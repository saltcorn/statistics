const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
const { mockReqRes } = require("@saltcorn/data/tests/mocks");
const { afterAll, beforeAll, describe, it, expect } = require("@jest/globals");

getState().registerPlugin("base", require("@saltcorn/data/base-plugin"));
getState().registerPlugin("@saltcorn/statistics", require(".."));

afterAll(require("@saltcorn/data/db").close);
beforeAll(async () => {
  // this works when the plugin-test command prepares the db with the -backup-file option
  await getState().refresh(true);
  // otherwise, the test could do this:

  // const { prep_test_db } = require("@saltcorn/data/plugin-testing");
  // const path = require("path");
  // const { prep_test_db } = require("@saltcorn/data/plugin-testing");
  // await prep_test_db(path.join(__dirname, "test-backup.zip"));
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
