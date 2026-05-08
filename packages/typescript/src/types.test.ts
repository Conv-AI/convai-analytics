/**
 * Compile-time + runtime asserts that the SDK's public response types
 * stay aliased to the OpenAPI snapshot. If `make gen-types` regenerates
 * a different shape, these `Equal<>` assertions break compilation
 * before any runtime drift can surface.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import type {
  BreakdownResponse,
  CatalogResponse,
  CubeQueryResponse,
  InteractionTrace,
  RegressionDetectionResponse,
  SessionDetail,
  SessionListResponse,
  SummaryResponse,
  TimeseriesResponse,
} from "./types.js";
import type { components } from "./_generated.js";

type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

const _summary: Equal<SummaryResponse, components["schemas"]["SummaryResponse"]> = true;
const _timeseries: Equal<TimeseriesResponse, components["schemas"]["TimeseriesResponse"]> = true;
const _breakdown: Equal<BreakdownResponse, components["schemas"]["BreakdownResponse"]> = true;
const _catalog: Equal<CatalogResponse, components["schemas"]["CatalogResponse"]> = true;
const _sessionList: Equal<SessionListResponse, components["schemas"]["SessionListResponse"]> = true;
const _sessionDetail: Equal<SessionDetail, components["schemas"]["SessionDetail"]> = true;
const _interaction: Equal<InteractionTrace, components["schemas"]["InteractionTrace"]> = true;
const _regression: Equal<RegressionDetectionResponse, components["schemas"]["RegressionResponse"]> = true;
const _cubeQuery: Equal<CubeQueryResponse, components["schemas"]["CubeQueryResponse"]> = true;
void _summary;
void _timeseries;
void _breakdown;
void _catalog;
void _sessionList;
void _sessionDetail;
void _interaction;
void _regression;
void _cubeQuery;

test("public response aliases match the OpenAPI snapshot at compile time", () => {
  // The real check is the type-level `Equal<>` above — if any of those go
  // false, the file fails to compile. This runtime test exists so node:test
  // counts the file as a passing test rather than just an empty module.
  assert.ok(true);
});
