/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
// https://openai-api-worker.andrewwoods88.workers.dev/
// when you make changes run npx wrangler deploy

import OpenAI from 'openai';

const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	// update to specific domain your request is coming from on production
	'Access-Control-Allow-Methods': 'POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
	async fetch(request, env, ctx) {
		// Handle CORS preflight requests
		if (request.method === 'OPTIONS') {
			return new Response(null, { headers: corsHeaders });
		}

		const url = new URL(request.url);
		const path = url.pathname;

		// Route handling
		switch (path) {
			case '/chat':
				return handleChatRequest(request, env);
			case '/another-endpoint':
				return handleAnotherEndpoint(request, env);
			case '/generate-image':
				return handleGenerateImage(request, env);
			default:
				return new Response('Not Found', { status: 404, headers: corsHeaders });
		}
	},
};

function initializeOpenAI(env) {
	return new OpenAI({
		apiKey: env.OPENAI_API_KEY,
		baseURL: env.API_BASE_URL_GATEWAY,
	});
}

async function handleGenerateImage(request, env) {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	const openai = initializeOpenAI(env);

	try {
		const { prompt } = await request.json();
		const response = await openai.images.generate({
			prompt,
			model: 'dall-e-3',
			n: 1,
			size: '1024x1024',
			response_format: 'b64_json',
		});

		// Extract the base64 image data
		const imageData = response.data[0].b64_json;

		return new Response(JSON.stringify({ image: imageData }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

async function handleChatRequest(request, env) {
	if (request.method !== 'POST') {
		return new Response(JSON.stringify({ error: `${request.method} Method not allowed` }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
	const openai = initializeOpenAI(env);

	try {
		const messages = await request.json();

		const chatCompletion = await openai.chat.completions.create({
			model: 'gpt-4',
			messages: messages,
			temperature: 1.1,
			presence_penalty: 0,
			frequency_penalty: 0,
		});
		const response = chatCompletion.choices[0].message;
		return new Response(JSON.stringify(response), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

async function handleAnotherEndpoint(request, env) {
	// Implement the logic for another endpoint
	return new Response('This is another endpoint', { headers: corsHeaders });
}

// function handleCORS(request, body) {
// 	const headers = new Headers({
// 		"Access-Control-Allow-Origin": "*",
// 		"Access-Control-Allow-Methods": "POST, GET, OPTIONS",
// 		"Access-Control-Allow-Headers": "Content-Type",
// 	});

// 	if (request.method === "OPTIONS") {
// 		return new Response(null, { headers });
// 	}

// 	return new Response(body, { headers });
// }
