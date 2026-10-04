import { SensitiveDataFilter } from '@mastra/observability';
/** Apply after the default filter so future upstream default fields remain protected. */
export const computerTraceFilter = () => new SensitiveDataFilter({sensitiveFields:['computerCapability']});
