import request, { postForm } from '../request';

type ParamsType = {
  params: LooseObject;
};
export const chunkPresence = ({ params }: ParamsType) =>
  request({
    params,
    url: '/fileChunk/presence',
  });
export const fileChunk = (formData: any) => postForm('/fileChunk', formData);
// request({
//   params,
//   method: 'POST',
//   url: 'fileChunk',
//   headers: {
//     'Content-Type': 'multipart/form-data',
//   },
// });
