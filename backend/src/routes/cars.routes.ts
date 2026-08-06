import { Router } from 'express';
import { createCarSchema, updateCarSchema } from '@car-rental/shared';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import { uploadCarImage } from '../middleware/upload.js';
import { CarsController } from '../controllers/cars.controller.js';
import {
  availableQuerySchema,
  carIdParamSchema,
  carImageIdParamSchema,
  carListQuerySchema,
} from '../validators/car.validator.js';

export const carsRouter = Router();

carsRouter.use('/cars', authenticate, authorize('ADMIN'));

// Must be registered before /cars/:id so "available" isn't matched as an id.
carsRouter.get('/cars/available', validate({ query: availableQuerySchema }), asyncHandler(CarsController.available));

carsRouter.get('/cars', validate({ query: carListQuerySchema }), asyncHandler(CarsController.list));
carsRouter.post('/cars', validate({ body: createCarSchema }), asyncHandler(CarsController.create));
carsRouter.get('/cars/:id', validate({ params: carIdParamSchema }), asyncHandler(CarsController.getById));
carsRouter.patch(
  '/cars/:id',
  validate({ params: carIdParamSchema, body: updateCarSchema }),
  asyncHandler(CarsController.update),
);
carsRouter.delete('/cars/:id', validate({ params: carIdParamSchema }), asyncHandler(CarsController.archive));
carsRouter.post(
  '/cars/:id/restore',
  validate({ params: carIdParamSchema }),
  asyncHandler(CarsController.restore),
);

carsRouter.post(
  '/cars/:id/images',
  validate({ params: carIdParamSchema }),
  uploadCarImage,
  asyncHandler(CarsController.uploadImage),
);
carsRouter.delete(
  '/cars/:id/images/:imageId',
  validate({ params: carImageIdParamSchema }),
  asyncHandler(CarsController.deleteImage),
);
carsRouter.post(
  '/cars/:id/images/:imageId/primary',
  validate({ params: carImageIdParamSchema }),
  asyncHandler(CarsController.setPrimaryImage),
);
