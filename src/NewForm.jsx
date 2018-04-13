import React from 'react';
import createDOMForm from '../rc-form/createDOMForm';
import createFormField from '../rc-form/createFormField';

class Form extends React.Component {

  static create(options){
    return createDOMForm({
      fieldNameProp: 'id',
      // ...options,
      fieldMetaProp: 'data-__meta',
      fieldDataProp: 'data-__field',
    });
  };

  render() {
    return <form />;
  }
}

export default Form;
