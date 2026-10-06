## Geo-provider fallback chain

Provider A manually disabled via GEO_PROVIDER_A_DISABLED=true — logs confirm
it was correctly skipped:
"Geo provider A manually disabled, skipping to provider B"

Provider B was then genuinely rate-limited by ipapi.co's free tier (confirmed
independently with a direct curl to https://ipapi.co/8.8.8.8/json/, which
returned the identical 429 RateLimited error with no app code involved).
The submission still completed successfully (id 16, 201) with
geo_provider_used left null — proving the system never lets a third-party
enrichment failure block the actual lead capture, exactly as designed.

[paste both log lines and the direct curl output here]