import { Router } from 'express';
import { createClientSchema, updateClientSchema } from '@car-rental/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorizePermission } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { uploadClientDocument } from '../middleware/upload.js';
import { ClientsController } from '../controllers/clients.controller.js';
import {
  clientCheckDuplicatesQuerySchema,
  clientDocumentIdParamSchema,
  clientExportQuerySchema,
  clientIdParamSchema,
  clientListQuerySchema,
} from '../validators/client.validator.js';

export const clientsRouter = Router();

// Every member of the agency (director and employees) — `authenticate` scopes
// each request to the caller's agency; director-only actions add
// authorizePermission() below.
clientsRouter.use('/clients', authenticate);

// Must be registered before /clients/:id so "export"/"check-duplicates" aren't
// matched as an id (mirrors /cars/export in cars.routes.ts).
clientsRouter.get(
  '/clients/export',
  validate({ query: clientExportQuerySchema }),
  asyncHandler(ClientsController.exportCsv),
);
clientsRouter.get(
  '/clients/export/xlsx',
  validate({ query: clientExportQuerySchema }),
  asyncHandler(ClientsController.exportXlsx),
);
clientsRouter.get(
  '/clients/check-duplicates',
  validate({ query: clientCheckDuplicatesQuerySchema }),
  asyncHandler(ClientsController.checkDuplicates),
);

clientsRouter.get('/clients', validate({ query: clientListQuerySchema }), asyncHandler(ClientsController.list));
clientsRouter.post('/clients', validate({ body: createClientSchema }), asyncHandler(ClientsController.create));
clientsRouter.get(
  '/clients/:id',
  validate({ params: clientIdParamSchema }),
  asyncHandler(ClientsController.getById),
);
clientsRouter.get(
  '/clients/:id/stats',
  validate({ params: clientIdParamSchema }),
  asyncHandler(ClientsController.getStats),
);
clientsRouter.patch(
  '/clients/:id',
  validate({ params: clientIdParamSchema, body: updateClientSchema }),
  asyncHandler(ClientsController.update),
);
clientsRouter.get(
  '/clients/:id/deletable',
  validate({ params: clientIdParamSchema }),
  asyncHandler(ClientsController.checkDeletable),
);
clientsRouter.delete(
  '/clients/:id',
  authorizePermission('client.delete'),
  validate({ params: clientIdParamSchema }),
  asyncHandler(ClientsController.delete),
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
