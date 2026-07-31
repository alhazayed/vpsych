export {
  getOpenAIClient,
  hasOpenAIApiKey,
  resetOpenAIClient,
  OpenAIConfigError,
} from "@/lib/ai/openai/client";
export {
  OpenAIServiceError,
  toOpenAIServiceError,
  type OpenAIErrorCode,
} from "@/lib/ai/openai/errors";
export { withOpenAIRetry, type RetryOptions } from "@/lib/ai/openai/retry";
export {
  openAIService,
  DEFAULT_OPENAI_CHAT_MODEL,
  DEFAULT_OPENAI_STT_MODEL,
  type ChatMessage,
  type ChatCompletionParams,
  type ChatCompletionResult,
  type SpeechToTextParams,
  type SpeechToTextResult,
  type OpenAIHealthStatus,
} from "@/lib/ai/openai/service";
