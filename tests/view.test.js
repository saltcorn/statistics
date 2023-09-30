const { getState } = require("@saltcorn/data/db/state");
const View = require("@saltcorn/data/models/view");
const Table = require("@saltcorn/data/models/table");
const { mockReqRes } = require("@saltcorn/data/tests/mocks");
const { afterAll, beforeAll, describe, it, expect } = require("@jest/globals");

getState().registerPlugin("base", require("@saltcorn/data/base-plugin"));
getState().registerPlugin("@saltcorn/statistics", require(".."));

afterAll(require("@saltcorn/data/db").close);
beforeAll(async () => {
  // works when the cli command is called with '-f' like this:
  //   saltcorn dev:plugin-test -d [PATH_TO_LOCAL_PLUGIN]/statistics -f backup.zip
  await getState().refresh(true);

  // //otherwise manually:
  // const { prep_test_db } = require("@saltcorn/cli/src/common");
  // await prep_test_db(
  //   require("path").join(__dirname, "backup.zip")
  // );
});

describe("statistics plugin tests", () => {
  it("run count_books", async () => {
    const view = View.findOne({ name: "count_books" });
    const result = await view.run({}, mockReqRes);
    const books = Table.findOne({ name: "books" });
    const dbCount = await books.countRows();
    expect(result).toBe(
      `<div><span class="count_books">${dbCount}</span></div>`
    );
  });

  it("run average rating", async () => {
    const view = View.findOne({ name: "average_rating" });
    const result = await view.run({}, mockReqRes);
    expect(result).toBe(`<div><span class="average_rating">4.333</span></div>`);
  });

  it("run average rating with where", async () => {
    const oldView = View.findOne({ name: "average_rating" });
    oldView.configuration.where_fml = '{ "book": 1 }';
    await View.update({ configuration: oldView.configuration }, oldView.id);
    const view = View.findOne(oldView.id);
    const result = await view.run({}, mockReqRes);
    expect(result).toBe(`<div><span class="average_rating">3.857</span></div>`);
  });
});
