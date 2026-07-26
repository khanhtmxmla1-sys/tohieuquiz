export class LiveExamServiceError extends Error {
  constructor(message: string, public readonly status: number = 400) {
    super(message);
    this.name = 'LiveExamServiceError';
  }
}
