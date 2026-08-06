import { Router } from 'express';
import { createClientSchema, updateClientSchema } from '@car-rental/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { uploadClientDocument } from '../middleware/upload.js';
import { ClientsController } from '../controllers/clients.controller.js';
import {
  clientDocumentIdParamSchema,
  clientIdParamSchema,
  clientListQuerySchema,
} from '../validators/client.validator.js';

export const clientsRouter = Router();

clientsRouter.use('/clients', authenticate, authorize('ADMIN'));

clientsRouter.get('/clients', validate({ query: clientListQuerySchema }), asyncHandler(ClientsController.list));
clientsRouter.post('/clients', validate({ body: createClientSchema }), asyncHandler(ClientsController.create));
clientsRouter.get(
  '/clients/:id',
  validate({ params: clientIdParamSchema }),
  asyncHandler(ClientsController.getById),
);
clientsRouter.patch(
  '/clients/:id',
  validate({ params: clientIdParamSchema, body: updateClientSchema }),
  asyncHandler(ClientsController.update),
);
clientsRouter.delete(
  '/clients/:id',
  validate({ params: clientIdParamSchema }),
  asyncHandler(ClientsController.archive),
);
clientsRouter.post(
  '/clients/:id/restore',
  validate({ params: clientIdParamSchema }),
  asyncHandler(ClientsController.restore),
);

clientsRouter.post(
  '/clients/:id/documents',
  validate({ params: clientIdParamSchema }),
  uploadClientDocument,
  asyncHandler(ClientsController.uploadDocument),
);
clientsRouter.delete(
  '/clients/:id/documents/:documentId',
  validate({ params: clientDocumentIdParamSchema }),
  asyncHandler(ClientsController.deleteDocument),
);
