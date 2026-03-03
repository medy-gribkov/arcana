export class CliError extends Error {
    code;
    exitCode;
    constructor(message, code = "CLI_ERROR", exitCode = 1) {
        super(message);
        this.code = code;
        this.exitCode = exitCode;
        this.name = "CliError";
    }
}
