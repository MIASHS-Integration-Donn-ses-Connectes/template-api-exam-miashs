import 'dotenv/config';
import Fastify from 'fastify';
import fetch from 'node-fetch';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { submitForReview } from './submission.js';

const fastify = Fastify({
  logger: true
});

// Configuration Swagger
await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'API Exam MIASHS',
      description: 'API pour les informations des villes',
      version: '1.0.0'
    },
    host: process.env.RENDER_EXTERNAL_URL || 'localhost:3000',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json']
  }
});

await fastify.register(swaggerUI, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: false
  },
  staticCSP: true,
  transformStaticCSP: (header) => header
});

// Fonctions utilitaires pour l'API des villes
async function getCityInfo(cityId) {
  try {
    const response = await fetch(`https://api-ugi2pflmha-ew.a.run.app/cities/${cityId}`);
    if (!response.ok) {
      throw new Error('City not found');
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

async function getWeatherInfo(lat, lon) {
  try {
    const response = await fetch(`https://api-ugi2pflmha-ew.a.run.app/weather?lat=${lat}&lon=${lon}`);
    if (!response.ok) {
      throw new Error('Weather data not available');
    }
    return await response.json();
  } catch (error) {
    throw error;
  }
}

async function getCityRecipes(cityId) {
  try {
    const response = await fetch(`https://api-ugi2pflmha-ew.a.run.app/cities/${cityId}/recipes`);
    if (!response.ok) {
      return [];
    }
    return await response.json();
  } catch (error) {
    return [];
  }
}

// Route principale pour l'examen
fastify.get('/cities/:cityId/infos', {
  schema: {
    params: {
      type: 'object',
      properties: {
        cityId: { type: 'string' }
      },
      required: ['cityId']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          coordinates: {
            type: 'array',
            items: { type: 'number' },
            minItems: 2,
            maxItems: 2
          },
          population: { type: 'integer' },
          knownFor: {
            type: 'array',
            items: { type: 'string' }
          },
          weatherPredictions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                when: { type: 'string' },
                min: { type: 'number' },
                max: { type: 'number' }
              }
            }
          },
          recipes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                content: { type: 'string' }
              }
            }
          }
        }
      },
      404: {
        type: 'object',
        properties: {
          error: { type: 'string' }
        }
      }
    }
  },
  async handler(request, reply) {
    try {
      const cityInfo = await getCityInfo(request.params.cityId);
      const weatherInfo = await getWeatherInfo(cityInfo.coordinates[0], cityInfo.coordinates[1]);
      const recipes = await getCityRecipes(request.params.cityId);

      const response = {
        coordinates: cityInfo.coordinates,
        population: cityInfo.population,
        knownFor: cityInfo.knownFor,
        weatherPredictions: [
          {
            when: 'today',
            min: weatherInfo.today.min,
            max: weatherInfo.today.max
          },
          {
            when: 'tomorrow',
            min: weatherInfo.tomorrow.min,
            max: weatherInfo.tomorrow.max
          }
        ],
        recipes: recipes
      };

      return reply.send(response);
    } catch (error) {
      if (error.message === 'City not found') {
        return reply.status(404).send({ error: 'City not found' });
      }
      return reply.status(500).send({ error: 'Internal server error' });
    }
  }
});

// Route racine pour vérifier que le serveur fonctionne
fastify.get('/', {
  schema: {
    response: {
      200: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          documentation: { type: 'string' }
        }
      }
    }
  },
  handler: async (request, reply) => {
    return {
      message: "Bienvenue sur l'API Exam MIASHS",
      documentation: "/docs"
    };
  }
});

// Démarrage du serveur
fastify.listen(
  {
    port: process.env.PORT || 3000,
    host: process.env.RENDER_EXTERNAL_URL ? '0.0.0.0' : process.env.HOST || 'localhost'
  },
  function (err) {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
    submitForReview(fastify);
  }
);