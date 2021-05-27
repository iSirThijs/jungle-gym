import type { RequestHandler } from '@sveltejs/kit';
import { api } from './_api';

export const get: RequestHandler = async (request) => {
	const response = await api(request, `games/${request.params.game}`);
	return response;
};
