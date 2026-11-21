import bcrypt from "bcryptjs";

export const PASSWORD_MIN = 10;
export const hashPassword = (p: string) => bcrypt.hash(p, 12);
export const verifyPassword = (p: string, h: string) => bcrypt.compare(p, h);
