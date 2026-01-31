import { sql } from '@vercel/postgres';

export async function query(queryString: string, params: any[] = []) {
    try {
        const result = await sql.query(queryString, params);
        return result;
    } catch (error) {
        console.error('Database Error:', error);
        throw error;
    }
}

export { sql };
