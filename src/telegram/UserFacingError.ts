/** Erro cuja mensagem pode (e deve) ser mostrada diretamente ao usuário no Telegram. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
