import React from 'react';
import Upload from './upload';

import 'antd/dist/antd.css';

function App() {
  const handleSuccess = () => {
    console.log('上传成功');
  };
  return (
    <div className="container">
      <React.StrictMode>
        <Upload limit={10} success={handleSuccess} />
      </React.StrictMode>
    </div>
  );
}
export default App;
