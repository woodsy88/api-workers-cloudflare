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
import { createClient } from '@supabase/supabase-js';

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
			case '/chat-turbo':
				return handleChatRequestTurbo(request, env);
			case '/multiple-chat':
				return handleMultipleChatRequest(request, env);
			case '/another-endpoint':
				return handleAnotherEndpoint(request, env);
			case '/generate-image':
				return handleGenerateImage(request, env);
			case '/handle-embedding':
				return handleEmbedding(request, env);
			case '/top-rated-movies':
				return handleTopRatedMovies(request, env);
			case '/top-rated-movies-formatted':
				return handleTopRatedMoviesFormatted(request, env);				
			case '/embed-chunks':
				return handleEmbedChunks(request, env);
			case '/handle-matching':
				return handleMatching(request, env);
				case '/handle-matching-object':
					return handleMatchingObject(request, env);				
			case '/embed-movies':
				return handleEmbedMovies(request, env);
			default:
				return new Response('Not Found', { status: 404, headers: corsHeaders });
		}
	},
};


async function handleMoviePoster(movie_db_id, env) {
	const baseUrl = 'http://image.tmdb.org/t/p/';
	const size = 'w500';

	try {
		const response = await fetch(`https://api.themoviedb.org/3/movie/${movie_db_id}`, {
			headers: {
				Authorization: `Bearer ${env.TMDB_TOKEN}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`TMDB API responded with status: ${response.status}`);
		}

		const data = await response.json();
		const posterPath = data.poster_path;
		const posterUrl = posterPath ? `${baseUrl}${size}${posterPath}` : null;

		return posterUrl;
	} catch (error) {
		console.error('Error fetching movie poster:', error);
		return null;
	}
}

async function handleTopRatedMovies(request, env) {
	// Check if the method is GET
	if (request.method !== 'GET') {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}

	try {
		const url = new URL(request.url);
		const page = url.searchParams.get('page') || 1;

		const response = await fetch(`https://api.themoviedb.org/3/movie/top_rated?page=${page}`, {
			headers: {
				Authorization: `Bearer ${env.TMDB_TOKEN}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`TMDB API responded with status: ${response.status}`);
		}

		const data = await response.json();
		const movieStrings = data.results.map(movie => 
			`Title: ${movie.title} Overview: ${movie.overview} Release Date: ${movie.release_date}`
		);

		const combinedMovieString = movieStrings.join(' ');

		return new Response(JSON.stringify({ movies: combinedMovieString }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error fetching top rated movies:', error);
		return new Response(JSON.stringify({ error: 'Failed to fetch top rated movies' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

async function handleTopRatedMoviesFormatted(request, env) {

	try {
		const url = new URL(request.url);
		const page = url.searchParams.get('page') || 1;

		const response = await fetch(`https://api.themoviedb.org/3/movie/top_rated?page=${page}`, {
			headers: {
				Authorization: `Bearer ${env.TMDB_TOKEN}`,
				'Content-Type': 'application/json',
			},
		});

		if (!response.ok) {
			throw new Error(`TMDB API responded with status: ${response.status}`);
		}

		const data = await response.json();
		const movieObjects = data.results.map(movie => {
			return {
				title: movie.title,
				releaseYear: movie.release_date,
				overview: movie.overview,
				movie_db_id: movie.id
			}
		});


		return new Response(JSON.stringify({ movies: movieObjects }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error fetching top rated movies:', error);
		return new Response(JSON.stringify({ error: 'Failed to fetch top rated movies' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}
function initializeOpenAI(env) {
	return new OpenAI({
		apiKey: env.OPENAI_API_KEY,
		baseURL: env.API_BASE_URL_GATEWAY,
	});
}

async function handleEmbedChunks(request, env) {
	const openai = initializeOpenAI(env);
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_API_KEY);

	let requestCount = 0; // Counter for OpenAI API requests

	async function batchEmbedChunks(chunks, batchSize = 50) {
		const embeddings = [];

		// Process chunks in batches
		for (let i = 0; i < chunks.length; i += batchSize) {
			// Slice the chunks array to get a batch of size 'batchSize' (or smaller for the last batch)
			const batch = chunks.slice(i, i + batchSize);

			try {
				requestCount++; // Increment the counter before making the request

				// Send a single request to OpenAI API with multiple inputs
				const response = await openai.embeddings.create({
					model: 'text-embedding-ada-002',
					// Map each chunk in the batch to its content
					input: batch.map(chunk => chunk.content),
				});

				if (!response.data || response.data.length === 0) {
					throw new Error('Unexpected response from OpenAI API');
				}

				// Process the response: combine original content with its embedding
				const batchEmbeddings = response.data.map((item, index) => ({
					content: batch[index].content,
					embedding: item.embedding,
				}));

				// Add the processed batch embeddings to the main embeddings array
				embeddings.push(...batchEmbeddings);

				console.log(`Successfully embedded batch ${Math.floor(i / batchSize) + 1}`);
			} catch (error) {
				console.error(`Error embedding batch ${Math.floor(i / batchSize) + 1}:`, error.message);
			}

			// Optional: Add a delay to avoid rate limits
			// Only delay if there are more batches to process
			if (i + batchSize < chunks.length) {
				await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
			}
		}

		return embeddings;
	}

	try {
		const data = await request.json();

		if (!Array.isArray(data.chunks) || data.chunks.length === 0) {
			throw new Error('Invalid or empty chunks array');
		}

		console.log('Received chunks:', data.chunks.length);

		// Process and filter chunks to ensure non-empty content
		const processedChunks = data.chunks
			.map(chunk => ({
				content: (chunk.pageContent || chunk.content || '').trim()
			}))
			.filter(chunk => chunk.content.length > 0);

		console.log('Processed chunks:', processedChunks.length);

		if (processedChunks.length === 0) {
			throw new Error('No valid content to create embeddings');
		}

		// Create embeddings in batches
		const embeddings = await batchEmbedChunks(processedChunks);

		console.log("All embeddings created. Total:", embeddings.length);
		console.log("Total requests made to OpenAI API:", requestCount);

		// Add embeddings to Supabase
		const supabaseData = await addToSupabase(supabase, embeddings);

		return new Response(JSON.stringify({ 
			totalChunks: processedChunks.length,
			embeddingsCreated: embeddings.length, 
			openAIRequests: requestCount,
			supabaseInserted: supabaseData.length,
			embeddings: embeddings
		}), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error in handleEmbedChunks:', error);
		return new Response(JSON.stringify({ 
			error: error.message,
			openAIRequests: requestCount
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

async function addToSupabase(supabase, data) {
	try {
		console.log(`Attempting to insert ${data.length} items in one operation`);
		
		const { data: insertedData, error } = await supabase
			.from("movies")
			.insert(data)
			.select();

		if (error) {
			console.error("Supabase insertion error:", JSON.stringify(error));
			throw error;
		}

		console.log(`Successfully inserted ${insertedData.length} items`);
		return insertedData;
	} catch (error) {
		console.error("Error in addToSupabase:", JSON.stringify(error));
		throw error;
	}
}

function checkMethodAllowed(request, allowedMethod = 'POST') {
	if (request.method !== allowedMethod) {
		return new Response(JSON.stringify({ error: 'Method not allowed' }), {
			status: 405,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
	return null;
}

async function handleEmbedding(request, env) {
	const openai = initializeOpenAI(env);

	try {
		const data = await request.json();
		const response = await openai.embeddings.create({
			model: 'text-embedding-ada-002',
			input: data.input,
		});

		const embeddingData = {
			content: data.input,
			embedding: response.data[0].embedding,
		};

		return new Response(JSON.stringify(embeddingData), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

async function handleGenerateImage(request, env) {
	const methodCheck = checkMethodAllowed(request);
	if (methodCheck) return methodCheck;

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
	const methodCheck = checkMethodAllowed(request);
	if (methodCheck) return methodCheck;

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

async function handleChatRequestTurbo(request, env) {
	const methodCheck = checkMethodAllowed(request);
	if (methodCheck) return methodCheck;

	const openai = initializeOpenAI(env);

	try {
		const messages = await request.json();

		const chatCompletion = await openai.chat.completions.create({
			model: 'gpt-3.5-turbo',
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

async function handleMultipleChatRequest(request, env) {


  const openai = initializeOpenAI(env);

  try {
    const messages = await request.json();

    const chatCompletions = await Promise.all(messages.map(async (message) => {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [message],
        temperature: 1.1,
        presence_penalty: 0,
        frequency_penalty: 0,
      });
      return completion.choices[0].message;
    }));

    return new Response(JSON.stringify(chatCompletions), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

async function handleMatching(request, env) {

	// const openai = initializeOpenAI(env);
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_API_KEY);

	try {
		const { prompt } = await request.json();
		console.log('Received prompt:', prompt);

		const findNearestMatches = async (embedding) => {
			console.log("Calling match_messages with embedding", embedding);
			const { data: matches, error } = await supabase.rpc('match_movies', {
				query_embedding: embedding,
				match_threshold: 0.5,
				match_count: 4,
			});
			if (error) {
				console.error('Error finding nearest matches:', error);
				throw error; // Throw the error to be caught in the outer try-catch
			}
			console.log("Matches returned:", matches);
			if (!matches || matches.length === 0) {
				console.log("No matches found");
				return "No matches found";
			}
			const match = matches.map((match) => match.content).join('\n');
			console.log("Concatenated match:", match);
			return match;
		};

		const result = await findNearestMatches(prompt.embedding);

		return new Response(JSON.stringify({ result }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});		
	} catch (error) {
		return new Response(JSON.stringify({ error: error.message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

async function handleMatchingObject(request, env) {
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_API_KEY);

	try {
		const { prompt } = await request.json();
		console.log('Received prompt:', prompt);

		if (!prompt || !prompt.embedding) {
			throw new Error('Invalid prompt or missing embedding');
		}

		const findNearestMatches = async (embedding) => {
			console.log("Calling match_movie_details with embedding", embedding);
			const { data: matches, error } = await supabase.rpc('match_movie_details', {
				query_embedding: embedding,
				match_threshold: 0.5,
				match_count: 4,
			});
			if (error) {
				console.error('Error finding nearest matches:', error);
				throw new Error(`Supabase RPC error: ${error.message}`);
			}
			console.log("Matches returned:", matches);
			if (!matches || matches.length === 0) {
				console.log("No matches found");
				return [];
			}
			console.log("Matches found:", matches);
			return matches;
		};

		const result = await findNearestMatches(prompt.embedding);

		// Fetch movie posters for each match
		const moviesWithPosters = await Promise.all(result.map(async (movie) => {
			const posterUrl = await handleMoviePoster(movie.movie_db_id, env);
			return { ...movie, posterUrl };
		}));

		return new Response(JSON.stringify({ result: moviesWithPosters }), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});		
	} catch (error) {
		console.error('Error in handleMatchingObject:', error);
		return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

async function handleAnotherEndpoint(request, env) {
	// Implement the logic for another endpoint
	return new Response('This is another endpoint', { headers: corsHeaders });
}

// Function that uses title and release year as column
async function handleEmbedMovies(request, env) {
	const openai = initializeOpenAI(env);
	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_API_KEY);

	let requestCount = 0; // Counter for OpenAI API requests

	async function batchEmbedMovies(movies, batchSize = 50) {
		const embeddings = [];

		for (let i = 0; i < movies.length; i += batchSize) {
			const batch = movies.slice(i, i + batchSize);

			try {
				requestCount++;
				const response = await openai.embeddings.create({
					model: 'text-embedding-ada-002',
					input: batch.map(movie => movie.overview),
				});

				if (!response.data || response.data.length === 0) {
					throw new Error('Unexpected response from OpenAI API');
				}

				const batchEmbeddings = response.data.map((item, index) => ({
					title: batch[index].title,
					release_year: batch[index].releaseYear,
					content: batch[index].overview,
					movie_db_id: batch[index].movie_db_id,
					embedding: item.embedding,
				}));

				embeddings.push(...batchEmbeddings);
				console.log(`Successfully embedded movie batch ${Math.floor(i / batchSize) + 1}`);
			} catch (error) {
				console.error(`Error embedding movie batch ${Math.floor(i / batchSize) + 1}:`, error.message);
			}

			if (i + batchSize < movies.length) {
				await new Promise(resolve => setTimeout(resolve, 1000));
			}
		}

		return embeddings;
	}

	try {
		const movies = await request.json();

		if (!Array.isArray(movies) || movies.length === 0) {
			throw new Error('Invalid or empty movies array');
		}

		console.log('Received movies:', movies.length);

		const embeddings = await batchEmbedMovies(movies);

		console.log("All movie embeddings created. Total:", embeddings.length);
		console.log("Total requests made to OpenAI API:", requestCount);

		const supabaseData = await addMoviesToSupabase(supabase, embeddings);

		return new Response(JSON.stringify({ 
			totalMovies: movies.length,
			embeddingsCreated: embeddings.length, 
			openAIRequests: requestCount,
			supabaseInserted: supabaseData.length,
			embeddings: embeddings
		}), {
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	} catch (error) {
		console.error('Error in handleEmbedMovies:', error);
		return new Response(JSON.stringify({ 
			error: error.message,
			openAIRequests: requestCount
		}), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' },
		});
	}
}

async function addMoviesToSupabase(supabase, movies) {
	try {
		console.log(`Attempting to insert ${movies.length} movies in one operation`);
		
		const { data: insertedData, error } = await supabase
			.from("movie_details")
			.insert(movies)
			.select();

		if (error) {
			console.error("Supabase movie insertion error:", JSON.stringify(error));
			throw error;
		}

		console.log(`Successfully inserted ${insertedData.length} movies`);
		return insertedData;
	} catch (error) {
		console.error("Error in addMoviesToSupabase:", JSON.stringify(error));
		throw error;
	}
}



