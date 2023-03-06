export default class UserError extends Error {
  readonly userError: string;
  readonly statusCode: number = 400;

  constructor(message: string) {
    super(message);
    this.userError = message;
  }
}
