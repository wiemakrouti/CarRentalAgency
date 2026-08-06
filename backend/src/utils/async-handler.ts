import type { NextFunction, Request, Response } from 'express';

// Express 4 does not forward a rejected promise from an async handler to
// error-handling middleware on its own — this wraps a controller so a thrown
// AppError/ZodError/etc. reaches `errorHandler` instead of hanging the request.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}
