const {
  input,
  div,
  text,
  script,
  domReady,
  style,
  button,
} = require("@saltcorn/markup/tags");
const View = require("@saltcorn/data/models/view");
const Workflow = require("@saltcorn/data/models/workflow");
const Table = require("@saltcorn/data/models/table");
const Form = require("@saltcorn/data/models/form");
const Field = require("@saltcorn/data/models/field");
const db = require("@saltcorn/data/db");
const { stateFieldsToWhere } = require("@saltcorn/data/plugin-helper");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "Statistic",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const statOptions = ["Count", "Avg", "Sum", "Max", "Min"];
          fields.forEach((f) => {
            if (f.type && f.type.name === "Date") {
              statOptions.push(`Latest ${f.name}`);
            }
          });
          return new Form({
            fields: [
              {
                name: "statistic",
                label: "Statistic",
                type: "String",
                required: true,
                attributes: {
                  options: statOptions,
                },
              },
              {
                name: "field",
                label: "field",
                type: "String",
                required: true,
                attributes: {
                  options: fields.map((f) => f.name).join(),
                },
              },
              {
                name: "text_style",
                label: "Text Style",
                type: "String",
                required: true,
                attributes: {
                  options: [
                    { label: "Normal", name: "" },
                    { label: "Heading 1", name: "h1" },
                    { label: "Heading 2", name: "h2" },
                    { label: "Heading 3", name: "h3" },
                    { label: "Heading 4", name: "h4" },
                    { label: "Heading 5", name: "h5" },
                    { label: "Heading 6", name: "h6" },
                    { label: "Bold", name: "font-weight-bold" },
                    { label: "Italics", name: "font-italic" },
                    { label: "Small", name: "small" },
                  ],
                },
              },
            ],
          });
        },
      },
    ],
  });

const get_state_fields = async (table_id, viewname, { show_view }) => {
  const table_fields = await Field.find({ table_id });
  return table_fields.map((f) => {
    const sf = new Field(f);
    sf.required = false;
    return sf;
  });
};

const run = async (
  table_id,
  viewname,
  { statistic, field, text_style },
  all_state,
  extraArgs
) => {
  const id = `map${Math.round(Math.random() * 100000)}`;
  const { _offset, ...state } = all_state;
  const tbl = await Table.findOne({ id: table_id });
  const fields = await tbl.getFields();
  const qstate = await stateFieldsToWhere({ fields, state });
  const { where, values } = db.mkWhere(qstate);
  const schema = db.getTenantSchemaPrefix();
  const { rows } = await db.query(
    `select ${db.sqlsanitize(statistic)}(${db.sqlsanitize(
      field
    )}) as the_stat from ${schema}"${tbl.name}" ${where}`,
    values
  );
  db.sql_log(rows)
  return div({ class: [text_style] }, rows[0].the_stat);
};

module.exports = {
  sc_plugin_api_version: 1,
  viewtemplates: [
    {
      name: "Statistic",
      display_state_form: false,
      get_state_fields,
      configuration_workflow,
      run,
    },
  ],
};
