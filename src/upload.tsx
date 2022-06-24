import React, { useState, useRef } from 'react';
import { Button, Input, message } from 'antd';
import { UploadOutlined, PauseCircleOutlined, PlayCircleOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { getItem, setItem } from './util/storage';
import { chunkPresence, fileChunk } from './apis/apiModules/uploadApis';

import styles from './app.less';

const chunkRetry = 3;
type UploadProps = {
  limit: number;
  success: Function;
};
const chunkSize = 10 * 1024 * 1024; // 切片大小
let fileIndex = 0; // 当前正在被遍历的文件下标
// 所有文件状态
enum TotalStatus {
  wait = 'wait',
  pause = 'pause',
  uploading = 'uploading',
  hash = 'hash',
  error = 'error',
  done = 'done',
}
// 单个文件的状态
enum FileStatus {
  wait = 'wait',
  uploading = 'uploading',
  success = 'success',
  error = 'error',
  secondPass = 'secondPass',
  pause = 'pause',
  resume = 'resume',
}
// 单个文件的状态 对应描述
enum FileStatusStr {
  wait = '待上传',
  uploading = '上传中',
  success = '成功',
  error = '失败',
  secondPass = '已秒传',
  pause = '暂停',
  resume = '恢复',
}
const Upload: React.FC<UploadProps> = (props) => {
  const { limit, success } = props;
  const [status, setStatus] = useState<TotalStatus>(TotalStatus.wait);
  const [uploadFiles, setUploadFiles] = useState<any[]>([]);
  const [uploadArguments, setUploadArguments] = useState<LooseObject>({});
  const worker = useRef<any>(null);

  // 文件数据初始化
  const handleStart = (file: File) => {
    const rawFile: any = file;
    console.log('handleStart', rawFile);
    rawFile.status = FileStatus.wait;
    rawFile.chunkList = [];
    rawFile.uploadProgress = 0;
    rawFile.fakeUploadProgress = 0; // 假进度条，处理恢复上传后，进度条后移的问题
    rawFile.hashProgress = 0;
    uploadFiles.push(rawFile);
    setUploadFiles(rawFile);
  };
  // 创建文件切片
  const createFileChunk = (file: File, size = chunkSize) => {
    const fileChunkList = [];
    let count = 0;
    while (count < file.size) {
      fileChunkList.push({
        file: file.slice(count, count + size),
      });
      count += size;
    }
    console.log('createFileChunk -> fileChunkList', fileChunkList);
    return fileChunkList;
  };
  // 生成文件 hash（web-worker）
  const calculateHash = (fileChunkList: Array<LooseObject>) => {
    return new Promise((resolve) => {
      worker.current = new Worker('./hash.js');
      worker.current.postMessage({ fileChunkList });
      worker.current.onmessage = (e: any) => {
        const { percentage, hash } = e.data;
        console.log('calculateHash->', e.data);
        if (uploadFiles[fileIndex]) {
          uploadFiles[fileIndex].hashProgress = Number(percentage.toFixed(0));
          setUploadFiles(uploadFiles.splice(fileIndex, 1, uploadFiles[fileIndex]));
        }
        if (hash) {
          resolve(hash);
        }
      };
    });
  };
  // 文件上传之前的校验： 校验文件是否已存在
  const verifyUpload = (fileName: string, fileHash: string) => {
    return new Promise((resolve) => {
      const obj = {
        md5: fileHash,
        fileName,
        ...uploadArguments,
      };

      chunkPresence({ params: obj })
        .then((res: any) => {
          console.log('verifyUpload -> res', res);
          resolve(res);
        })
        .catch((err: any) => {
          console.log('verifyUpload -> err', err);
        });
    });
  };
  // 判断是否已完成上传
  const isAllStatus = () => {
    const isAllSuccess = uploadFiles.every((item) => ['success', 'secondPass', 'error'].includes(item));
    if (isAllSuccess) {
      setStatus(TotalStatus.done);
      if (typeof success === 'function') {
        success();
      }
    }
  };
  // 上传文件
  const sendRequest = (forms: any, chunkData: any) => {
    console.log('sendRequest -> forms', forms);
    console.log('sendRequest -> chunkData', chunkData);
    let finished = 0;
    const total = forms.length;
    const retryArr: Array<number> = []; // 数组存储每个文件hash请求的重试次数，做累加 比如[1,0,2],就是第0个文件切片报错1次，第2个报错2次

    return new Promise((resolve, reject) => {
      const handler = () => {
        if (forms.length) {
          const formInfo = forms.shift();

          const { formData } = formInfo;
          const { index } = formInfo;
          // 开始上传切片
          fileChunk(formData)
            .then((res) => {
              console.log('handler -> res', res);
              // 更改状态
              chunkData[index].uploaded = true;
              chunkData[index].status = 'success';
              // 存储已上传的切片下标
              setItem(chunkData[index].fileHash, index);
              finished++;
              handler();
            })
            .catch(() => {
              // 若状态为暂停或等待，则禁止重试
              console.log('handler -> this.status', status);
              if ([TotalStatus.pause, TotalStatus.wait].includes(status)) return;
              if (typeof retryArr[index] !== 'number') {
                retryArr[index] = 0;
              }
              // 更新状态
              chunkData[index].status = 'warning';

              // 累加错误次数
              retryArr[index]++;
              // 重试3次
              if (retryArr[index] >= chunkRetry) {
                console.warn(' 重试失败--- > handler -> retryArr', retryArr, chunkData[index].hash);
                return reject('重试失败', retryArr);
              }
              // 将失败的重新加入队列
              forms.push(formInfo);
              handler();
            });
        }

        if (finished >= total) {
          resolve('done');
        }
      };

      // 控制并发
      for (let i = 0; i < total; i++) {
        handler();
      }
    });
  };
  // 通知服务端合并切片
  const mergeRequest = (data) => {
    const mergeObj = {
      md5: data.fileHash,
      fileName: data.name,
      fileChunkNum: data.chunkList.length,
    };
  };
  // 将切片传输给服务端
  const uploadChunks = async (data: any) => {
    console.log('uploadChunks -> data', data);
    const chunkData = data.chunkList;
    return new Promise(async (resolve, reject) => {
      const requestDataList = chunkData
        .filter(({ uploaded }: LooseObject) => !uploaded)
        .map(({ fileHash, chunk, fileName, index }: LooseObject) => {
          console.log('chunk', chunk);
          const formData = new FormData();
          formData.append('md5', fileHash);
          formData.append('fileName', index); // 文件名使用切片的下标
          formData.append('file', chunk);
          return { formData, index, fileName };
        });
      console.log('requestDataList', requestDataList, chunkData);

      try {
        const ret = await sendRequest(requestDataList, chunkData);
        console.log('sendRequest->ret', ret);
      } catch (error) {
        message.error(`上传失败了,考虑重试下呦${error}`);
      }

      // 合并切片
      const isUpload = chunkData.some((item: any) => item.uploaded === false);
      console.log('created -> isUpload', isUpload);
      if (isUpload) {
        message.error('存在失败的切片');
      } else {
        // 执行合并
        try {
          await mergeRequest(data);
          resolve(true);
        } catch (error) {
          reject();
        }
      }
    });
  };
  const handleUpload = async () => {
    console.log('handleUpload -> uploadFiles', uploadFiles);
    if (!uploadFiles.length) return;
    setStatus(TotalStatus.uploading);
    const filesArr = uploadFiles; // 文件列表
    for (let i = 0; i < uploadFiles.length; i++) {
      fileIndex = i;
      if (['secondPass', 'success', 'error'].includes(filesArr[i].status)) {
        console.log('跳过已上传成功或已秒传的或失败的');
        continue;
      }
      const fileChunkList = createFileChunk(filesArr[i]);

      // 若不是恢复，再进行hash计算
      if (filesArr[i].status !== 'resume') {
        setStatus(TotalStatus.hash);
        // eslint-disable-next-line no-await-in-loop
        filesArr[i].hash = await calculateHash(fileChunkList);
        console.log('handleUpload->hash', filesArr[i].hash);
        // 若清空或者状态为等待，则跳出循环
        if (status === TotalStatus.wait) {
          console.log('若清空或者状态为等待，则跳出循环');
          break;
        }
      }
      setStatus(TotalStatus.uploading);

      // 开始上传
      // eslint-disable-next-line no-await-in-loop
      const verifyRes: any = await verifyUpload(filesArr[i].name, filesArr[i].hash);
      console.log('verifyRes', verifyRes);
      if (verifyRes.presence) {
        filesArr[i].status = FileStatus.secondPass;
        filesArr[i].uploadProgress = 100;
        isAllStatus();
      } else {
        console.log('开始上传文件----》', filesArr[i].name);
        filesArr[i].status = FileStatus.uploading;
        const getChunkStorage = getItem(filesArr[i].hash);
        filesArr[i].fileHash = filesArr[i].hash; // 文件的hash，合并时使用
        filesArr[i].chunkList = fileChunkList.map(({ file }, index) => ({
          fileHash: filesArr[i].hash,
          fileName: filesArr[i].name,
          index,
          hash: `${filesArr[i].hash}-${index}`,
          chunk: file,
          size: file.size,
          uploaded: getChunkStorage && getChunkStorage.includes(index), // 标识：是否已完成上传
          progress: getChunkStorage && getChunkStorage.includes(index) ? 100 : 0,
          status: getChunkStorage && getChunkStorage.includes(index) ? 'success' : 'wait', // 上传状态，用作进度状态显示
        }));
        // this.$set(filesArr, i, filesArr[i]);
        // eslint-disable-next-line no-await-in-loop
        await uploadChunks(filesArr[i]);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent): void => {
    const target = e.target as HTMLInputElement;
    const files: FileList = target.files as FileList;
    if (!files) return;
    fileIndex = 0;
    console.log('handleFileChange->', target.files);
    if (files.length > limit) {
      message.info(`文件数不能大于${limit}`);
    }
    setStatus(TotalStatus.wait);
    const postFile = Array.prototype.slice.call(files);
    console.log('handleFileChange->postFile', postFile);
    postFile.forEach((item) => {
      handleStart(item);
    });
    handleUpload();
  };
  return (
    <div className={styles.upload}>
      <Button icon={<UploadOutlined />}>
        {/* 选择文件 */}
        <Input multiple className={styles['file-input']} type="file" onChange={handleFileChange} />
      </Button>
      <Button icon={<CloudUploadOutlined />} onClick={handleUpload}>
        {/* 上传 */}
      </Button>
      {/* <Button icon={<PauseCircleOutlined />}>暂停</Button>
      <Button icon={<PlayCircleOutlined />}>继续上传</Button> */}
    </div>
  );
};

export default Upload;
