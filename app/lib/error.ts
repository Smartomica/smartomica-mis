export class NeverError extends Error {
  constructor(value: never) {
    super(`Unexpected value: ${value}`);
  }
}
