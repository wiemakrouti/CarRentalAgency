import { Router } from 'express';
import { createClientSchema, updateClientSchema } from '@car-rental/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { uploadClientDocument } from '../middleware/upload.js';
import { ClientsController } from '../controllers/clients.controller.js';
import {
  clientCheckPhoneQuerySchema,
  clientDocumentIdParamSchema,
  clientExportQuerySchema,
  clientIdParamSchema,
  clientListQuerySchema,
} from '../validators/client.validator.js';

export const clientsRouter = Router();

clientsRouter.use('/clients', authenticate, authorize('ADMIN'));

// Must be registered before /clients/:id so "export"/"check-phone" aren't
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
  '/clients/check-phone',
  validate({ query: clientCheckPhoneQuerySchema }),
  asyncHandler(ClientsController.checkPhoneDuplicate),
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
