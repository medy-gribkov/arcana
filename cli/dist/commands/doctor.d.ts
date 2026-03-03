import type { DoctorCheck } from "../types.js";
export declare function runDoctorChecks(): DoctorCheck[];
export declare function doctorCommand(opts?: {
    json?: boolean;
}): Promise<void>;
