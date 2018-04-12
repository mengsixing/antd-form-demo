import React from 'react';
// 自动复制所有非React静态方法
import hoistStatics from 'hoist-non-react-statics';
import createReactClass from 'create-react-class';

function getDisplayName(WrappedComponent) {
  return WrappedComponent.displayName || WrappedComponent.name || 'WrappedComponent';
}

function argumentContainer(Container, WrappedComponent) {
  Container.displayName = `Form(${getDisplayName(WrappedComponent)})`;
  Container.WrappedComponent = WrappedComponent;
  return hoistStatics(Container, WrappedComponent);
}

class MyForm extends React.Component{
  
  static create(){
    return function decorate(WrappedComponent) {
      const Form = createReactClass({
        fieldsStore:{},
        getForm() {
          return {
            getFieldsValue: this.fieldsStore.getFieldsValue,
            getFieldValue: this.fieldsStore.getFieldValue,
            getFieldInstance: this.getFieldInstance,
            setFieldsValue: this.setFieldsValue,
            setFields: this.setFields,
            setFieldsInitialValue: this.fieldsStore.setFieldsInitialValue,
            getFieldDecorator: this.getFieldDecorator,
            getFieldProps: this.getFieldProps,
            getFieldsError: this.fieldsStore.getFieldsError,
            getFieldError: this.fieldsStore.getFieldError,
            isFieldValidating: this.fieldsStore.isFieldValidating,
            isFieldsValidating: this.fieldsStore.isFieldsValidating,
            isFieldsTouched: this.fieldsStore.isFieldsTouched,
            isFieldTouched: this.fieldsStore.isFieldTouched,
            isSubmitting: this.isSubmitting,
            submit: this.submit,
            validateFields: this.validateFields,
            resetFields: this.resetFields,
          };
        },
        render() {
          var props={form:this.getForm()};
          return <WrappedComponent {...props} />;
        },
      });
      //复制静态属性
      return argumentContainer(Form, WrappedComponent);
    }
  }

  render(){
    return (
      <form {...this.props}></form>
    )
  }

}

export default MyForm;
