
import { sql } from '@vercel/postgres';

export default async function query(queryString, params = []) {
    try {
        const result = await sql.query(queryString, params);
        return result;
    } catch (error) {
        console.error('Database Error:', error);
        throw error;
    }
}
