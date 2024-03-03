const {
  input,
  div,
  span,
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
const {
  jsexprToWhere,
  jsexprToSQL,
} = require("@saltcorn/data/models/expression");

const db = require("@saltcorn/data/db");
const { getState } = require("@saltcorn/data/db/state");

const { stateFieldsToWhere } = require("@saltcorn/data/plugin-helper");
const { mergeIntoWhere } = require("@saltcorn/data/utils");
const { localeDate, localeDateTime } = require("@saltcorn/markup");

const configuration_workflow = () =>
  new Workflow({
    steps: [
      {
        name: "Statistic",
        form: async (context) => {
          const table = await Table.findOne({ id: context.table_id });
          const fields = await table.getFields();
          const statOptions = [
            "Count",
            "Count distinct",
            "Avg",
            "Sum",
            "Max",
            "Min",
          ];
          fields.forEach((f) => {
            if (f.type && f.type.name === "Date") {
              statOptions.push(`Latest ${f.name}`);
            }
          });
          const fieldOptions = fields.map((f) => f.name);
          if (jsexprToSQL) fieldOptions.push("Formula");
          const floatFVs = getState().types.Float.fieldviews;
          const field_view_options = Object.entries(floatFVs)
            .filter(([k, v]) => !v.isEdit && !v.isFilter)
            .map(([k, v]) => k);
          const fvConfigFields = [];
          for (const fvnm of field_view_options) {
            const cfgflds = floatFVs[fvnm].configFields || [];

            const flds =
              typeof cfgflds === "function"
                ? cfgflds({ attributes: {} }) // a fake field
                : cfgflds;
            //console.log({ fvnm, flds });
            flds.forEach((fld) => {
              fvConfigFields.push({ ...fld, showIf: { fieldview: fvnm } });
            });
          }

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
                  options: fieldOptions,
                },
              },

              {
                name: "value_fml",
                label: "Value Formula",
                class: "validate-expression",
                type: "String",
                required: false,
                showIf: { field: "Formula" },
              },
              {
                name: "fieldview",
                label: "Field view",
                type: "String",
                required: false,
                attributes: {
                  options: field_view_options,
                },
              },
              ...fvConfigFields,
              {
                name: "where_fml",
                label: "Where",
                sublabel: "Formula",
                class: "validate-expression",
                type: "String",
                required: false,
              },
              {
                name: "decimal_places",
                label: "Decimal places",
                type: "Integer",
                required: false,
                showIf: { fieldview: "" },
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
              {
                name: "pre_text",
                label: "Text before",
                sublabel: "For example: currency symbol",
                type: "String",
                required: false,
              },
              {
                name: "post_text",
                label: "Text after",
                sublabel: "For example: units",
                type: "String",
                required: false,
              },
            ],
          });
        },
      },
    ],
  });

const get_state_fields = async (table_id, viewname, { show_view }) => {
  const table = Table.findOne(table_id);
  const table_fields = table.fields;
  return table_fields.map((f) => {
    const sf = new Field(f);
    sf.required = false;
    return sf;
  });
};
const statisticOnField = (statistic, field) => {
  if (statistic === "Count distinct") return `count(distinct ${field})`;
  return `${db.sqlsanitize(statistic)}(${field})`;
};
const getStatisticsImpl = async (
  table_id,
  { statistic, field, where_fml, value_fml },
  state,
  req
) => {
  if (!field || !statistic) return "";
  const tbl = await Table.findOne({ id: table_id });
  const fields = await tbl.getFields();
  const { ...qstate } = await stateFieldsToWhere({ fields, state });
  mergeIntoWhere(qstate, jsexprToWhere(where_fml, { user: req.user }));

  if (tbl.aggregationQuery) {
    const the_stat = { aggregate: statistic };
    if (field !== "Formula") the_stat.field = field;
    else the_stat.valueFormula = value_fml;
    const aggRes = await tbl.aggregationQuery(
      {
        the_stat,
      },
      { where: qstate }
    );
    return [aggRes];
  }
  const { where, values } = db.mkWhere(qstate);

  const schema = db.getTenantSchemaPrefix();
  const fieldExpr =
    field === "Formula" ? jsexprToSQL(value_fml) : db.sqlsanitize(field);
  let sql;
  if (statistic.startsWith("Latest ")) {
    const dateField = statistic.replace("Latest ", "");
    sql = `select ${fieldExpr} as the_stat from ${schema}"${db.sqlsanitize(
      tbl.name
    )}"
    where ${dateField}=(select max(${dateField}) from ${schema}"${db.sqlsanitize(
      tbl.name
    )}" ${where ? ` and ${where}` : ""})`;
  } else
    sql = `select ${statisticOnField(
      statistic,
      fieldExpr
    )} as the_stat from ${schema}"${db.sqlsanitize(tbl.name)}" ${where}`;

  const { rows } = await db.query(sql, values);
  return rows;
};

const run = async (
  table_id,
  viewname,
  {
    statistic,
    field,
    text_style,
    fieldview,
    decimal_places,
    pre_text,
    post_text,
    where_fml,
    value_fml,
    ...fvOpts
  },
  state,
  { req },
  queriesObj
) => {
  const rows = queriesObj?.statistics_query
    ? await queriesObj.statistics_query(state)
    : await getStatisticsImpl(
        table_id,
        { statistic, field, where_fml, value_fml },
        state,
        req
      );
  let the_stat = rows[0].the_stat;
  if (the_stat === null && statistic == "Sum") the_stat = 0;

  const wrapper = (t) =>
    div(
      { class: [text_style] },
      pre_text || "",
      span({ class: viewname }, t),
      post_text || ""
    );

  if (fieldview) {
    const fv = getState().types.Float.fieldviews[fieldview];
    return wrapper(fv.run(the_stat, req, fvOpts));
  }
  const show_stat =
    the_stat instanceof Date
      ? localeDateTime(the_stat)
      : typeof decimal_places === "undefined"
      ? the_stat
      : (+the_stat).toFixed(decimal_places);
  return wrapper(show_stat);
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
      queries: ({
        table_id,
        configuration: { statistic, field, where_fml, value_fml },
        req,
      }) => ({
        async statistics_query(state) {
          return await getStatisticsImpl(
            table_id,
            { statistic, field, where_fml, value_fml },
            state,
            req
          );
        },
      }),
    },
  ],
};
