document.getElementById('login-btn').addEventListener('click',function(event){
    event.preventDefault();
    const user=document.getElementById('user-id').value;
    const password=document.getElementById('password').value;
    if(user==="mahmuda"){
        if(password==="1234"){
            window.location.href='./main.html'

        }
        else{
            alert('Please Give the correct password')
        }
    }
    else{
        alert('Please Give the Correct User ID')
    }

})