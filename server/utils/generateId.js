import { v4 as uuidv4 } from 'uuid';


/* Genera un ID único usando UUID v4
* Reemplaza el uso de Date.now() por IDs más robustos
*/
export const generateId = () => {
    return uuidv4();
};


/* Genera un ID numérico simple (para compatibilidad con código existente)
* Úsalo solo si necesita mantener IDs numéricos
*/
export const generateNumericId = () => {
    return Date.now().toString();
};