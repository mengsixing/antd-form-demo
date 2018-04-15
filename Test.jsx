import React from 'react';
// import MyForm from  './src/NewForm'
import hoistStatics from 'hoist-non-react-statics';


//复制包裹组件的静态方法到Container里
function argumentContainer(Container, WrappedComponent) {
  /* eslint no-param-reassign:0 */
  Container.displayName = `zheshixiesideDisplayName`;
  Container.WrappedComponent = WrappedComponent;
  var result =hoistStatics(Container, WrappedComponent);
  console.log('result 是什么？');
  return result;
}

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


class Container extends React.Component {
  render(){
    return (
        <div>
          <div>form container</div>
        </div>
    )
  }
}

class WrappedComponent extends React.Component {
  render(){
    return (
        <div>
          <div>form wrappered</div>
        </div>
    )
  }
}

// export default MyForm.create()(Test);

export default argumentContainer(Container,WrappedComponent);
