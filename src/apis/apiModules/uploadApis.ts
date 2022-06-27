import request, { postForm } from '../request';

// type ParamsType = {
//   params: LooseObject;
// };
export const chunkPresence = (params: LooseObject) =>
  request({
    params,
    url: '/fileChunk/presence',
  });
export const fileChunk = (formData: any) =>
  // postForm('/fileChunk', formData);
  request({
    data: formData,
    method: 'POST',
    url: '/fileChunk',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

export const mergeChunks = (data: LooseObject) =>
  request({
    url: '/fileChunk/merge',
    method: 'POST',
    data,
  });
