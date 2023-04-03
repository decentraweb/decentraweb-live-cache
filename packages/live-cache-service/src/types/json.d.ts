export type JSONValue = string | number | boolean | JSONObject | JSONArray;

export type JSONObject = Record<string, JSONValue>;

export interface JSONArray extends Array<JSONValue> {}
