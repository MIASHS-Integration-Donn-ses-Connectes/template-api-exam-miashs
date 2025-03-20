// src/index.js
import Fastify from 'fastify';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { submitForReview } from './submission.js';

dotenv.config();

const fastify = Fastify({
  logger: true
});

// Variables globales
const API_KEY = process.env.API_KEY;
const BASE_URL = 'https://api-ugi2pflmha-ew.a.run.app';
let recipes = {};

// Middleware pour vérifier si une ville existe
async function checkCityExists(cityId) {
  const response = await fetch(`${BASE_URL}/cities/${cityId}/insights?apiKey=${API_KEY}`);
  
  if (!response.ok) {
    throw new Error('City not found');
  }
  
  return response.json();
}

// Route racine
fastify.get('/', async () => {
  return { message: 'API is running' };
});

// Route 1: GET /cities/:cityId/infos
fastify.get('/cities/:cityId/infos', async (request, reply) => {
  try {
    const { cityId } = request.params;
    const city = await checkCityExists(cityId);
    
    const weatherResponse = await fetch(`${BASE_URL}/weather/${cityId}?apiKey=${API_KEY}`);

    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const weatherData = await weatherResponse.json();
    const weatherPredictions = weatherData.map((prediction, index) => ({
      when: index === 0 ? 'today' : 'tomorrow',
      min: prediction.min,
      max: prediction.max
    }));

    return {
      coordinates: [city.latitude, city.longitude],
      population: city.population,
      knownFor: city.knownFor,
      weatherPredictions,
      recipes: recipes[cityId] || []
    };
  } catch (error) {
    reply.code(404).send({ error: error.message });
  }
});

// Route 2: POST /cities/:cityId/recipes
fastify.post('/cities/:cityId/recipes', async (request, reply) => {
  try {
    const { cityId } = request.params;
    const { content } = request.body;

    await checkCityExists(cityId);

    if (!content) {
      return reply.code(400).send({ error: 'Content is required' });
    }
    if (content.length < 10) {
      return reply.code(400).send({ error: 'Content is too short (minimum 10 characters)' });
    }
    if (content.length > 2000) {
      return reply.code(400).send({ error: 'Content is too long (maximum 2000 characters)' });
    }

    const recipeId = Date.now();
    const recipe = { id: recipeId, content };

    if (!recipes[cityId]) {
      recipes[cityId] = [];
    }
    recipes[cityId].push(recipe);

    return reply.code(201).send(recipe);
  } catch (error) {
    reply.code(404).send({ error: error.message });
  }
});

// Route 3: DELETE /cities/:cityId/recipes/:recipeId
fastify.delete('/cities/:cityId/recipes/:recipeId', async (request, reply) => {
  try {
    const { cityId, recipeId } = request.params;
    
    await checkCityExists(cityId);

    if (!recipes[cityId]) {
      return reply.code(404).send({ error: 'No recipes found for this city' });
    }

    const recipeIndex = recipes[cityId].findIndex(r => r.id === parseInt(recipeId));
    if (recipeIndex === -1) {
      return reply.code(404).send({ error: 'Recipe not found' });
    }

    recipes[cityId].splice(recipeIndex, 1);
    return reply.code(204).send();
  } catch (error) {
    reply.code(404).send({ error: error.message });
  }
});

// Démarrage du serveur
const start = async () => {
  try {
    await fastify.listen({ 
      host: process.env.HOST || '0.0.0.0', 
      port: parseInt(process.env.PORT || 3000)
    });
    console.log(`Server listening on ${fastify.server.address().port}`);
    
    if (process.env.RENDER_EXTERNAL_URL) {
      await submitForReview(fastify);
    }
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();