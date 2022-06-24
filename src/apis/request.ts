import axios from 'axios';
import type { AxiosResponse, AxiosRequestConfig } from 'axios';
import qs from 'qs';
import { message } from 'antd';
import { getItem } from '../util/storage';

const baseURL = process.env.LILY_APP_API;
console.log('baseURL', baseURL, process.env);

const service = axios.create({
  baseURL,
  // withCredentials: true,
  timeout: 12000,
  maxContentLength: Infinity,
  headers: {
    // 'Content-Type': 'application/json',
    // 'X-Client-Type': 'web',
  },
});

service.interceptors.request.use(
  (configDefault: AxiosRequestConfig = {}) => {
    const { headers } = configDefault;
    const config: AxiosRequestConfig = { method: 'get', ...configDefault };
    const token = getItem('token') || headers?.token;
    if (token) {
      config.headers = {
        ...headers,
        token,
        'X-Access-Token': token,
      };
    }
    if (config.method === 'get') {
      config.paramsSerializer = function (params: any) {
        return qs.stringify(params, { arrayFormat: 'repeat' });
      };
    }
    return config;
  },
  (error) => {
    console.log(error);
    return Promise.reject(error);
  }
);

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const res = response.data;
    // if (resData instanceof Blob && resData.type === 'application/json') {
    //   resData = JSON.parse(await resData.text());
    // }
    console.log('interceptors-----', res);
    if (res.code != null && +res.code !== 2000) {
      message.info({ content: res.msg || res.message });
      return Promise.reject(res);
    }
    if (res.data && res.data.errors) {
      message.info({ content: res.data.errors || 'Error' });
      return Promise.reject(new Error(res.data.errors || 'Error'));
    }
    return Object.prototype.hasOwnProperty.call(res, 'data') ? res.data : res;
  },
  (error) => {
    console.log('error', error, error.response);
    if (error.config.headers.unmessage) {
      return Promise.reject(error);
    }
    if (error.response) {
      if (error.response.status === 426) {
        message.info({ content: '您的帐号已在其他设备登录' });
      } else {
        message.info({ content: error.response?.message || error.response?.data?.message || error.response?.data?.msg || '网络异常，请稍后重试' });
      }
    } else {
      message.info({ content: error?.message || error?.msg || '网络异常，请稍后重试' });
    }

    return Promise.reject(error);
  }
);
export const postForm = function (url: string, formData: any) {
  console.log('baseURL + url', baseURL + url);
  return axios.post(baseURL + url, formData);
};
export default service;
