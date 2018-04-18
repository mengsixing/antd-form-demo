import React from 'react';
import ReactDOM from 'react-dom';
// import { createForm } from './rc-form';
import { createForm } from './src';

class Form extends React.Component {
  constructor(){
    super();
    this.onSubmit=this.onSubmit.bind(this);
    this.onChange=this.onChange.bind(this);
    this.xxx=this.xxx.bind(this);
  }
  componentWillMount() {
    //设置表单项名称，和规则
    this.nameDecorator = this.props.form.getFieldDecorator('name2', {
      initialValue: '',
      rules: [{
        required: true,
        message: 'What\'s your name?',
      }],
    });
  }

  onSubmit(e) {
    e.preventDefault();
    this.props.form.validateFields((error, values) => {
      if (!error) {
        console.log('ok', values);
      } else {
        console.log('error', error, values);
      }
    });
  };

  onChange(e) {
    console.log(this.props.form.getFieldValue('name2'));
  }
  xxx(){
    this.props.form.setFieldsValue({ems:{name2:'哈哈',name3:'nihao'}});
  }

  render() {
    const { getFieldError } = this.props.form;

    return (
      <form onSubmit={this.onSubmit}>
      
        {this.nameDecorator(
          <input
            onChange={this.onChange}
          />
        )}
        <div style={{ color: 'red' }}>
          {(getFieldError('name') || []).join(', ')}
        </div>
        <button>Submit</button>
        <button onClick={this.xxx} type="button">button3</button>
      </form>
    );
  }
}

const WrappedForm = createForm()(Form);

export default WrappedForm;
