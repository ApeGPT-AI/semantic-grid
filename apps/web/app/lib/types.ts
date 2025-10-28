export type TNewQueryReq = {
  query: string;
};

export type TNewQueryResp = {
  sessionID?: string;
  status: string;
  error?: any;
};

export type TQueryStatusReq = {
  sessionID: string;
};

export type TQueryStatusResp = {
  status: string;
  error?: any;
  data?: any;
};

export type TResponseResult = {
  session_id: string; // UUID of the session
  request_id: string; // UUID of the request
  sequence_number: number; // Sequence number of the response
  request: string; // Original request text
  response?: string; // Response text
  status: string; // Status of the response (e.g., "Done", "Error", "Pending")
  sql?: string; // SQL query string
  err?: string; // Error message, if any
  review?: string; // User's review of the response
  rating?: number; // User's rating of the response
  explanation?: any; // Explanation of the response, if applicable
  intent?: string; // User's intent for the query
  assumptions?: string; // Assumptions made by the AI
  intro?: string; // Introductory text for the response
  outro?: string; // Concluding text for the response
  csv?: string; // CSV formatted data, if applicable
  chart?: any; // Chart data, if applicable
  chart_url?: string; // URL to the chart, if applicable
  raw_data_labels?: string[]; // Labels for raw data rows
  raw_data_rows?: any[][]; // Raw data rows
  refs: any; // References used in the response
  linked_session_id?: string; // UUID of the linked session, if any
  query?: TQuery; // Optional query object
  view?: TView; // Optional view object
};

export type TColumn = {
  id: string;
  column_name: string;
  column_type: string;
  column_alias?: string;
  column_description?: string;
  summary?: string;
};

export type TQueryMetadata = {
  id: string; // UUID
  summary?: string;
  sql?: string;
  columns?: TColumn[];
  parents?: string[]; // Array of parent query IDs
  result?: string;
};

export type TUserSession = {
  created_at: string;
  message_count: number;
  metadata: TQueryMetadata;
  name: string;
  parent: any;
  refs: any;
  session_id: string;
  tags: string;
  user: string;
};

export type TStructuredResponse = {
  request: string;
  sql?: string;
  assumptions?: string;
  intent?: string;
  intro?: string;
  outro?: string;
  csv?: string;
  chart?: string;
  chart_url?: string;
  raw_data_labels?: string[];
  raw_data_rows?: any[][];
  metadata?: TQueryMetadata;
  refs: any;
  linked_session_id?: string; // UUID of the linked session
};

export type TQuery = {
  query_id: string; // UUID
  request: string; // Original request text
  parent_id?: string; // UUID of the parent query
  ai_context?: any; // AI context, if any
  ai_generated?: boolean; // Whether the query was AI-generated
  columns: TColumn[]; // Array of columns in the query
  data_source?: string; // Data source for the query
  db_dialect?: string; // Database dialect (e.g., SQL, NoSQL)
  err?: string; // Error message, if any
  explanation?: any;
  intent?: string; // User's intent for the query
  summary?: string; // Summary of the query
  sql?: string; // SQL query string
  row_count?: number; // Number of rows returned by the query
};

export type TView = {
  sort_by?: string; // Column to sort by
  sort_order?: "asc" | "desc"; // Sort order
  limit?: number; // Limit on the number of rows
  offset?: number; // Offset for pagination
};

export type TChatMessage = {
  isBot?: boolean;
  isError?: boolean;
  isPending?: boolean;
  status?: string;
  text?: string;
  uid: string;
  isNew?: boolean;
  sql?: string;
  rating?: number;
  comment?: string;
  structuredResponse?: TStructuredResponse;
  isStructured?: boolean;
  query?: TQuery;
  view?: TView;
};

export type TChatSection = {
  id: string;
  requestId?: string; // UUID of the request
  label: string;
  status?: string;
  chat: string[];
  messages: TChatMessage[];
  metadata?: TQueryMetadata;
  linkedSession?: string; // UUID of the linked session
  query?: TQuery; // Optional query object
  view?: TView; // Optional view object
};

export type TChat = {
  id?: string; // UUID
  uid: string;
  topic: string;
  lastUpdated: number; // timestamp
  tags?: string[];
  messages: TChatMessage[];
  parent?: string; // parent session ID
  children?: TChat[]; // Array of child sessions
};

export type TChatHistory = Array<TChat>;

export enum LegacyFlow {
  OpenAISimple = "OpenAISimple",
  OpenAISimpleNWH = "OpenAISimpleNWH",
  OpenAISimpleV2 = "OpenAISimpleV2",
  GeminiSimple = "GeminiSimple",
  GeminiSimpleNWH = "GeminiSimpleNWH",
  GeminiSimpleV2 = "GeminiSimpleV2",
  DeepseekSimple = "DeepseekSimple",
  DeepseekSimpleNWH = "DeepseekSimpleNWH",
  DeepseekSimpleV2 = "DeepseekSimpleV2",
  OpenAIMultisteps = "OpenAIMultisteps",
  GeminiMultistep = "GeminiMultistep",
  DeepseekMultistep = "DeepseekMultistep",
}

export enum Flow {
  Simple = "Simple",
  Multistep = "Multistep",
  Interactive = "Interactive",
}

export enum Model {
  OpenAI = "OpenAI",
  Gemini = "Gemini",
  Deepseek = "Deepseek",
  Anthropic = "Anthropic",
}

export enum DB {
  Legacy = "",
  NWH = "NWH",
  V2 = "V2",
}

/**
 * SSE event payload from the backend
 * Sent via the /api/sse/{session_id} endpoint
 */
export type SSERequestUpdate = {
  request_id: string;
  session_id: string;
  status: string;
  updated_at: number;
  has_response: boolean;
  has_error: boolean;
  sequence_number: number;
};

export type SSEConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";
