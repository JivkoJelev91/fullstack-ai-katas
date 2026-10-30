/**
 * Application error types shared by the data-access tasks.
 * The tests check for these classes, so throw them (or subclasses) as each task specifies.
 */

export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(
    message: string,
    readonly details: FieldError[] = [],
  ) {
    super("VALIDATION_ERROR", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super("NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super("CONFLICT", message);
  }
}

export class InvalidStateError extends AppError {
  constructor(message = "Operation not allowed in the current state") {
    super("INVALID_STATE", message);
  }
}
