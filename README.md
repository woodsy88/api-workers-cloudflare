# OpenAI API Cloudflare Worker

This project is a Cloudflare Worker that integrates with the OpenAI API. It serves as a backend for handling OpenAI API requests.

## Run locally

`npm run dev`
note: need to point your frontend endpoints at the dev server: http://localhost:8787

## Install OpenAI in your Worker project
`npm install openai`

## Save API key to your Workers environment
set the OPENAI_API_KEY environment variable
`npx wrangler secret put OPENAI_API_KEY`

set the API_BASE_URL_GATEWAY environment variable
`npx wrangler secret put API_BASE_URL_GATEWAY`


## Deploy the latest Worker changes
`npx wrangler deploy `