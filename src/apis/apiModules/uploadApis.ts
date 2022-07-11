import request, { postForm } from '../request';

// type ParamsType = {
//   params: LooseObject;
// };
export const chunkPresence = (params: LooseObject) =>
  request({
    params,
    url: '/fileChunk/presence',
  });
export const fileChunk = ({ formData, onUploadProgress, cancelToken }: LooseObject) =>
  // postForm('/fileChunk', formData);
  request({
    data: formData,
    method: 'POST',
    url: '/fileChunk',
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: 0,
    onUploadProgress,
    cancelToken,
  });

export const mergeChunks = (data: LooseObject) =>
  request({
    url: '/fileChunk/merge',
    method: 'POST',
    data,
  });
