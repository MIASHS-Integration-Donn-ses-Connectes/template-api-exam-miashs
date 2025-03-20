// index.js
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
  const response = await fetch(`${BASE_URL}/cities/${cityId}`, {
    headers: { 'x-api-key': API_KEY }
  });
  
  if (!response.ok) {
    throw new Error('City not found');
  }
  
  return response.json();
}

// Route 1: GET /cities/:cityId/infos
fastify.get('/cities/:cityId/infos', async (request, reply) => {
  try {
    const { cityId } = request.params;
    const city = await checkCityExists(cityId);
    
    // Récupération des données météo
    const weatherResponse = await fetch(`${BASE_URL}/weather/${cityId}`, {
      headers: { 'x-api-key': API_KEY }
    });

    if (!weatherResponse.ok) {
      throw new Error('Failed to fetch weather data');
    }

    const weatherData = await weatherResponse.json();
    const weatherPredictions = weatherData.map((prediction, index) => ({
      when: index === 0 ? 'today' : 'tomorrow',
      min: prediction.min,
      max: prediction.max
    }));

    const response = {
      coordinates: [city.latitude, city.longitude],
      population: city.population,
      knownFor: city.knownFor,
      weatherPredictions,
      recipes: recipes[cityId] || []
    };

    return response;
  } catch (error) {
    fastify.log.error(error);
    reply.code(404).send({ error: error.message });
  }
});

// Route 2: POST /cities/:cityId/recipes
fastify.post('/cities/:cityId/recipes', async (request, reply) => {
  try {
    const { cityId } = request.params;
    const { content } = request.body;

    // Vérification si la ville existe
    await checkCityExists(cityId);

    // Validation du contenu
    if (!content) {
      reply.code(400).send({ error: 'Content is required' });
      return;
    }
    if (content.length < 10) {
      reply.code(400).send({ error: 'Content is too short (minimum 10 characters)' });
      return;
    }
    if (content.length > 2000) {
      reply.code(400).send({ error: 'Content is too long (maximum 2000 characters)' });
      return;
    }

    const recipeId = Date.now();
    const recipe = { id: recipeId, content };

    if (!recipes[cityId]) {
      recipes[cityId] = [];
    }
    recipes[cityId].push(recipe);

    reply.code(201).send(recipe);
  } catch (error) {
    fastify.log.error(error);
    reply.code(404).send({ error: error.message });
  }
});

// Route 3: DELETE /cities/:cityId/recipes/:recipeId
fastify.delete('/cities/:cityId/recipes/:recipeId', async (request, reply) => {
  try {
    const { cityId, recipeId } = request.params;

    // Vérification si la ville existe
    await checkCityExists(cityId);

    const cityRecipes = recipes[cityId];
    if (!cityRecipes) {
      reply.code(404).send({ error: 'No recipes found for this city' });
      return;
    }

    const recipeIndex = cityRecipes.findIndex(r => r.id === parseInt(recipeId));
    if (recipeIndex === -1) {
      reply.code(404).send({ error: 'Recipe not found' });
      return;
    }

    cityRecipes.splice(recipeIndex, 1);
    reply.code(204).send();
  } catch (error) {
    fastify.log.error(error);
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
    
    // Soumettre pour examen si on est sur Render
    await submitForReview(fastify);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();