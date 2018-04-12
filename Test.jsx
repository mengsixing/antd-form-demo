import React from 'react';
import MyForm from  './src/Form'



class Test extends React.Component {
  render(){
    console.log(this.props);
    return (
      <MyForm>
        <div>
          <div>form item</div>
        </div>
      </MyForm>
    )
  }
}

export default MyForm.create()(Test);
