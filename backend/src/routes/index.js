import { Router } from 'express';
import { profilesRouter } from './profiles.js';
import { agentRouter } from './agent.js';
import { matchesRouter } from './matches.js';
import { opportunitiesRouter } from './opportunities.js';
import { eventsRouter } from './events.js';
import { insightsRouter } from './insights.js';
import { authRouter } from './auth.js';
import { propiasRouter } from './propias.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/profiles', profilesRouter);
apiRouter.use('/agent', agentRouter);
apiRouter.use('/matches', matchesRouter);
apiRouter.use('/propias', propiasRouter);
apiRouter.use('/opportunities', opportunitiesRouter);
apiRouter.use('/events', eventsRouter);
apiRouter.use('/insights', insightsRouter);
