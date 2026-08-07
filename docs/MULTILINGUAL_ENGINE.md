# Multilingual Engine — Stage 11

**Code:** `src/lib/realtime/multilingual.ts`  
**UI i18n:** `next-intl` + `messages/{en,ar}.json` (unchanged)  
**Personalities:** natively authored `en-US` / `ar-JO` — never machine-translated.

## Capabilities

| Capability | Behavior |
|------------|----------|
| Arabic / English | `RealtimeSpeechLocale` `en` \| `ar` \| `mixed` |
| Mixed-language sessions | Detection sets `mixed`; providers use primary fallback |
| Automatic language detection | Script heuristics (Arabic block vs Latin) |
| Runtime language switching | `applyRuntimeLanguageSwitch` / `observeUtterance` |
| RTL support | `isRtlLocale` → `dir=rtl` on chrome / transcript lines |
| Bidirectional transcripts | `toBidirectionalLine` per utterance |

## Provider locale

`speechLocaleForProviders()` maps mixed → session primary (`en`|`ar`) for STT/TTS.

## Boundaries

- Does **not** translate avatar personalities  
- Does **not** change diagnosis by locale  
- UI string catalog remains `messages/*.json` — add keys to both files  
